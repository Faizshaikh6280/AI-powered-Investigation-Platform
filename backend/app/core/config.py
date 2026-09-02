import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "investigative_platform"
    
    NEO4J_URI: str = "neo4j+s://b38f0696.databases.neo4j.io"
    NEO4J_USERNAME: str = "b38f0696"
    NEO4J_PASSWORD: str = "t2o93WjHCH1B1O5TfZRROgCPTodI16SG-oIhZ-Bbj2E"
    
    REDIS_URI: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"

settings = Settings()
