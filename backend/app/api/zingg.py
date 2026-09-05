from typing import Optional
from fastapi import APIRouter
from app.services.zingg_er import run_entity_resolution

router = APIRouter()

@router.post("/execute")
async def execute_entity_resolution(case_id: Optional[str] = None):
    """
    Run full Entity Resolution pipeline on canonical events for case_id.
    """
    result = await run_entity_resolution(case_id=case_id)
    return result
