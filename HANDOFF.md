# Project Handoff - AI Virtual Tutor

## Current Status
All requested fixes and UI adjustments have been completed and verified.

### Recent Changes (2026-09-21)
1. **Reference Materials Summary Box Clean Up**:
   - Removed the unwanted `AI Summary:` display block from `frontend/src/pages/student/DoubtSolver.jsx` under "Active Syllabus Sources" as requested.
   - Updated `backend/app/services/rag_service.py` to ensure LLM error strings are sanitized and never saved into material summaries.

2. **Study Planner "Generate Plan" & Reset Plan Fixes**:
   - Updated `backend/app/routes/subjects.py` so `/api/subjects` automatically populates the `topics` list for each subject.
   - Enhanced `frontend/src/pages/student/StudyPlanner.jsx` to ensure topics are always available and selectable when subjects are toggled.
   - Added automatic selection of the first topic upon selecting a subject, along with "Select All" / "Clear" controls, preventing the "Generate Plan" button from being stuck in a disabled state.
   - Fixed property bindings in `StudyPlanner.jsx` (`task_id`, `topic`, `subject`, and `day_number`) for seamless display and completion toggling of generated study plan tasks.
   - Removed the native `window.confirm` browser dialog on "Reset Study Plan", allowing direct, instant deletion and reset of the active plan.

3. **Reference Material Upload Fix for Students**:
   - Fixed `AttributeError: 'str' object has no attribute 'value'` in `backend/app/routes/reference_materials.py` when processing material upload form submissions.
   - Normalized type handling so incoming string types (`pdf`, `text`, `docx`, `pptx`, `image`) or inferred file extensions are supported properly without throwing 500 errors.
   - In `frontend/src/pages/student/DoubtSolver.jsx`, added the missing `type` parameter to `handleFileUpload` formData, preventing 422 Unprocessable Entity validation failures.
   - Enhanced subject and topic resolution in `backend/app/routes/reference_materials.py` with flexible ObjectId/string matching and dynamic name attachment.

4. **Faculty Dashboard Clean Up (Announcements Banner Removal)**:
   - Removed the top announcements banner from the main Faculty Dashboard (`frontend/src/pages/faculty/FacultyDashboard.jsx`).
   - Announcements remain exclusively accessible and manageable on the dedicated Announcements page (`/faculty/announcements`), keeping the dashboard clean and consistent with the student dashboard experience.

## Running the Application
- **Backend**: `python run.py` inside `backend/` (running on http://localhost:8000).
- **Frontend**: `npm run dev` inside `frontend/` (running on http://localhost:5173).

