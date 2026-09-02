import uuid
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from neo4j import GraphDatabase
from app.core.config import settings
from app.core.celery_app import celery_app

class Neo4jAnalytics:
    def __init__(self):
        self.driver = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD))
        
    def close(self):
        self.driver.close()

    def run_query(self, query, parameters=None):
        with self.driver.session() as session:
            result = session.run(query, parameters)
            return [record.data() for record in result]

@celery_app.task(name='anomaly_engine.run_detection')
def run_anomaly_detection():
    analytics = Neo4jAnalytics()
    try:
        # Extract features using pure Cypher to support all Aura instances without compute session overhead
        query = '''
            MATCH (n)
            OPTIONAL MATCH (n)-[r]-()
            WITH n, count(r) AS degree
            
            // Calculate clustering / triangles naively for small graphs
            OPTIONAL MATCH (n)-->(a)-->(b)-->(n)
            WITH n, degree, count(a) AS triangles
            
            RETURN 
                elementId(n) AS entity_id, 
                labels(n)[0] AS type, 
                degree, 
                triangles
        '''
        results = analytics.run_query(query)
        
        df = pd.DataFrame(results)
        if df.empty:
            return {"status": "error", "message": "Graph is empty"}
            
        df.fillna(0, inplace=True)

        features = ['degree', 'triangles']
        X = df[features]
        
        if len(X) < 5:
             return {"status": "success", "message": "Too few nodes for ML detection"}
             
        # Machine Learning (Isolation Forest)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        model = IsolationForest(
            n_estimators=300,
            contamination=0.1,
            random_state=42,
            n_jobs=-1
        )
        
        df['anomaly_flag'] = model.fit_predict(X_scaled)
        df['if_score'] = model.score_samples(X_scaled)
        
        min_score = df['if_score'].min()
        max_score = df['if_score'].max()
        if max_score > min_score:
            df['anomaly_score'] = 100 * (1 - (df['if_score'] - min_score) / (max_score - min_score))
        else:
            df['anomaly_score'] = 0

        anomalies = df[(df['anomaly_flag'] == -1) & (df['anomaly_score'] > 50)]
        
        for _, row in anomalies.iterrows():
            entity_id = row['entity_id']
            if not entity_id:
                continue
                
            score = float(row['anomaly_score'])
            severity = "CRITICAL" if score > 90 else "HIGH" if score > 70 else "MEDIUM"
            
            reasons = []
            if row['degree'] > X['degree'].quantile(0.90):
                reasons.append(f"Unusually high connectivity (Degree: {int(row['degree'])})")
            if row['triangles'] > X['triangles'].quantile(0.90):
                reasons.append(f"Part of unusually dense local cluster")
                
            if not reasons:
                reasons.append("Isolation Forest detected unusual network behavior")
                
            metrics = {
                "isolationForestScore": score,
                "degree": int(row['degree']),
                "triangles": int(row['triangles'])
            }

            anomaly_id = f"ANOMALY-{uuid.uuid4()}"
            
            analytics.run_query('''
                MATCH (e) WHERE elementId(e) = $entity_id
                MERGE (a:Anomaly {id: $anomaly_id})
                SET a.score = $score,
                    a.severity = $severity,
                    a.type = 'Graph Structural',
                    a.reasons = $reasons,
                    a.metrics = $metrics,
                    a.detectedAt = datetime(),
                    a.status = 'NEW',
                    a.entityType = $entityType,
                    a.entityId = coalesce(e.golden_id, e.number, e.account_number, e.address, e.imei_number, e.tower_id, e.handle, elementId(e))
                MERGE (e)-[:HAS_ANOMALY]->(a)
            ''', {
                "entity_id": entity_id,
                "anomaly_id": anomaly_id,
                "score": score,
                "severity": severity,
                "reasons": reasons,
                "metrics": str(metrics),
                "entityType": row['type']
            })

        return {"status": "success", "anomalies_detected": len(anomalies)}

    except Exception as e:
        print(f"Anomaly engine failed: {str(e)}")
        return {"status": "error", "message": str(e)}
    finally:
        analytics.close()
