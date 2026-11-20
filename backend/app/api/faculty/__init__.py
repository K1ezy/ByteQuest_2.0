"""Faculty (instructor) workspace API.

Every route enforces the instructor role, an active account, and an active
course assignment. Administrators use the separate /api/v1/admin routes and
never receive academic approval or answer-key editing here.
"""

from fastapi import APIRouter

from app.api.faculty import overview, drafts, materials, activities, performance, announcements

router = APIRouter(prefix="/api/v1/faculty", tags=["Faculty workspace"])
# Included in the original file order, so route matching order is unchanged.
router.include_router(overview.router)
router.include_router(drafts.router)
router.include_router(materials.router)
router.include_router(activities.router)
router.include_router(performance.router)
router.include_router(announcements.router)
