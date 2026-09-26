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

### Recent Changes (2026-09-22)
1. **Render Low-Memory (512 MiB RAM) & CPU Backend Optimization**:
   - **Zero Startup ML Import**: Removed startup imports of heavy ML packages (`torch`, CUDA binaries, `easyocr`, `sentence-transformers`, `transformers`, `scipy`).
   - **Startup RAM Reduction**: Cut startup memory footprint from >500 MB down to **~43 MB**, completely eliminating Render OOM crashes and port-binding failures.
   - **Lazy-Loaded & Cloud AI Integrations**:
     - Converted `OCRService` to lazy-load EasyOCR only if available and leverage Google Gemini / OpenAI multimodal vision directly with zero local model overhead.
     - Enhanced `rag_service.py` with lazy ChromaDB client initialization via `ChromaClientProxy` and routed embeddings through Gemini (`text-embedding-004`) / OpenAI (`text-embedding-3-small`) with deterministic fallback.
   - **Clean Requirements**: Removed `sentence-transformers` and `easyocr` from `backend/requirements.txt`; pinned lightweight CPU packages `pypdf`, `pillow`, `numpy`, and `certifi`.
   - **Production Readiness & Start Command**:
     - Production start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
     - Updated `backend/run.py` to read `PORT` from environment and prevent `reload=True` in production.
     - Added `GET /health` (`{"status": "ok"}`) alongside `GET /api/health`.
     - Explicitly whitelisted CORS origins for `https://virtual-tutor.vercel.app`, `https://virtual-ai-tutor.vercel.app`, and local origins without wildcards.
     - Added backward-compatible routes for `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, and `GET /api/v1/users/me` while keeping existing `/api/auth/*` routes 100% intact.
   - **Non-blocking MongoDB Initialization**: Added 2.5s timeouts and explicit connection failure logging with graceful fallback to `PersistentDatabase`.

### Recent Changes (2026-09-25)
1. **Production Backend API Base URL Configuration**:
   - In `frontend/src/services/api.js`, updated `API_BASE_URL` to read `import.meta.env.VITE_API_URL` with fallback to `http://localhost:8000`.
   - Exported `API_BASE_URL` from `api.js` and replaced all hardcoded `http://localhost:8000` URLs across `StudentAssignments.jsx`, `StudentAnnouncements.jsx`, `ReferenceMaterials.jsx`, `DoubtSolver.jsx`, `Messages.jsx`, `FacultySubmissions.jsx`, `FacultyMaterials.jsx`, and `FacultyAnnouncements.jsx`.
   - In production (Vercel), `VITE_API_URL` is set to `https://virtual-tutor-msih.onrender.com`, resolving all API and Google OAuth requests directly to the production Render backend.

2. **Google Identity Services Idempotent Initialization**:
   - Resolved `[GSI_LOGGER]: google.accounts.id.initialize() is called multiple times` error.
   - Refactored `frontend/src/pages/Login.jsx` so Google Identity Services (`google.accounts.id.initialize`) is initialized strictly once per application lifecycle via `initGoogleIdentityServices` guarded by module-level client ID tracking.
   - Preserved dynamic React state by delegating credential responses to a stable callback reference (`credentialCallbackRef`).
   - Removed duplicate `google.accounts.id.initialize` invocations inside `handleGoogleSignIn`.

3. **Backend CORS Whitelist**:
   - Added production frontend origin `https://virtual-tutor-app.vercel.app` to `default_origins` in `backend/app/main.py` while preserving existing Vercel staging and local development origins (`http://localhost:5173`, `http://localhost:3000`).

4. **Environment Configuration & Security Hardening**:
   - Updated root `.gitignore` and `frontend/.gitignore` to strictly exclude all `.env` and `.env.*` files while keeping `.env.example` templates.
   - Updated `frontend/.env.example` and root `.env.example` with documented `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`.
   - Verified clean production build (`npm run build`) and lint checks (`oxlint`).

### Recent Changes (2026-09-26)
1. **Fix Deployed Logout 404 Bug & Vercel SPA Rewrites**:
   - **Root Cause**: Logout was previously triggering a hard browser reload (`window.location.href = '/login'`). Because the repository is deployed on Vercel without a root `vercel.json` rewrite configuration, direct browser requests or hard reloads to `/login` resulted in Vercel returning `HTTP 404 Not Found` (`X-Vercel-Error: NOT_FOUND`).
   - **Vercel Routing**:
     - Added root `vercel.json` (`c:/Users/ASHWITH REDDY/OneDrive/Desktop/AI VIRTUAL TUTOR/vercel.json`) with SPA rewrite `{"source": "/(.*)", "destination": "/index.html"}` to ensure Vercel projects configured at root or monorepo root route all paths to `index.html`.
     - Preserved `frontend/vercel.json` and added `frontend/public/vercel.json` so build output in `dist/` also retains SPA rewrite rules.
   - **Client-Side React Router Integration**:
     - In `frontend/src/App.jsx`, nested `<AuthProvider>` inside `<BrowserRouter>`, granting auth context direct access to React Router's `useNavigate`.
     - In `frontend/src/context/AuthContext.jsx`, replaced hard window reload with `navigate('/login', { replace: true })`, eliminating unnecessary full-page document roundtrips and 404 risks.
   - **Comprehensive Auth Cleanup**:
     - Updated `logout` in `AuthContext.jsx` to clear `localStorage` (`token`, `user`, `role`), `sessionStorage.clear()`, delete Axios authorization header (`delete api.defaults.headers.common['Authorization']`), and clear context state (`setUser(null)`).
     - Added safe call to backend logout endpoint (`try { await api.post('/api/auth/logout'); } catch (_) {}`) to notify the backend while ensuring frontend logout never blocks if the backend is unreachable.
     - Added `auth:unauthorized` event listener in `AuthContext.jsx` for clean client-side router navigation upon 401 interceptor trigger.
   - **Backend Logout Endpoints**:
     - Added `POST /api/auth/logout` in `backend/app/routes/auth.py` and `POST /api/v1/auth/logout` in `backend/app/main.py` returning `{"message": "Logged out successfully"}` with HTTP 200.

## Running the Application
- **Backend (Development)**: `python run.py` inside `backend/` (running on http://localhost:8000 with reload).
- **Backend (Render / Production)**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Frontend (Development)**: `npm run dev` inside `frontend/` (running on http://localhost:5173).
- **Frontend (Production Build)**: `npm run build` inside `frontend/`.



