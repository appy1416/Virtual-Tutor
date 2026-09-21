import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Student Page imports
import StudentDashboard from './pages/student/StudentDashboard';
import Subjects from './pages/student/Subjects';
import TopicDetails from './pages/student/TopicDetails';
import AITutor from './pages/student/AITutor';
import Quiz from './pages/student/Quiz';
import QuizResult from './pages/student/QuizResult';
import StudyPlanner from './pages/student/StudyPlanner';
import DoubtSolver from './pages/student/DoubtSolver';
import ReferenceMaterials from './pages/student/ReferenceMaterials';
import StudentAssignments from './pages/student/StudentAssignments';
import StudentAnnouncements from './pages/student/StudentAnnouncements';

// Faculty Page imports
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultyStudents from './pages/faculty/FacultyStudents';
import FacultyClasses from './pages/faculty/FacultyClasses';
import FacultyAssignments from './pages/faculty/FacultyAssignments';
import FacultySubmissions from './pages/faculty/FacultySubmissions';
import FacultyQuizzes from './pages/faculty/FacultyQuizzes';
import FacultyAnalytics from './pages/faculty/FacultyAnalytics';
import FacultyMaterials from './pages/faculty/FacultyMaterials';
import FacultyAnnouncements from './pages/faculty/FacultyAnnouncements';
import CourseCreator from './pages/faculty/CourseCreator';
import ExamCreator from './pages/faculty/ExamCreator';

// Admin Page imports
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageUsers from './pages/admin/ManageUsers';
import ManageClasses from './pages/admin/ManageClasses';
import PlatformAnalytics from './pages/admin/PlatformAnalytics';
import AIUsageTelemetry from './pages/admin/AIUsageTelemetry';

// Shared Page imports
import Notifications from './pages/shared/Notifications';
import Messages from './pages/shared/Messages';
import Profile from './pages/shared/Profile';

// Route protector verifying session and role validation
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8B5CF6]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'faculty') return <Navigate to="/faculty" replace />;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/student" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Root Redirector based on logged in role
const HomeRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8B5CF6]"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'faculty') return <Navigate to="/faculty" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/student" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login />} />

          {/* Student routes */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/subjects" element={<ProtectedRoute allowedRoles={['student']}><Subjects /></ProtectedRoute>} />
          <Route path="/subjects/:subjectId/topics/:topicId" element={<ProtectedRoute allowedRoles={['student']}><TopicDetails /></ProtectedRoute>} />
          <Route path="/ai-tutor" element={<ProtectedRoute allowedRoles={['student']}><AITutor /></ProtectedRoute>} />
          <Route path="/quiz" element={<ProtectedRoute allowedRoles={['student']}><Quiz /></ProtectedRoute>} />
          <Route path="/quizzes" element={<ProtectedRoute allowedRoles={['student']}><Quiz /></ProtectedRoute>} />
          <Route path="/quiz-result" element={<ProtectedRoute allowedRoles={['student']}><QuizResult /></ProtectedRoute>} />
          <Route path="/planner" element={<ProtectedRoute allowedRoles={['student']}><StudyPlanner /></ProtectedRoute>} />
          <Route path="/doubt-solver" element={<ProtectedRoute allowedRoles={['student']}><DoubtSolver /></ProtectedRoute>} />
          <Route path="/reference-materials" element={<ProtectedRoute allowedRoles={['student', 'faculty', 'admin']}><ReferenceMaterials /></ProtectedRoute>} />
          <Route path="/assignments" element={<ProtectedRoute allowedRoles={['student']}><StudentAssignments /></ProtectedRoute>} />
          <Route path="/student/assignments" element={<ProtectedRoute allowedRoles={['student']}><StudentAssignments /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute allowedRoles={['student', 'faculty', 'admin']}><StudentAnnouncements /></ProtectedRoute>} />


          {/* Faculty routes */}
          <Route path="/faculty" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyDashboard /></ProtectedRoute>} />
          <Route path="/faculty/students" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyStudents /></ProtectedRoute>} />
          <Route path="/faculty/classes" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyClasses /></ProtectedRoute>} />
          <Route path="/faculty/assignments" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyAssignments /></ProtectedRoute>} />
          <Route path="/faculty/submissions" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultySubmissions /></ProtectedRoute>} />
          <Route path="/faculty/quizzes" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyQuizzes /></ProtectedRoute>} />
          <Route path="/faculty/progress" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyAnalytics /></ProtectedRoute>} />
          <Route path="/faculty/analytics" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyAnalytics /></ProtectedRoute>} />
          <Route path="/faculty/materials" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyMaterials /></ProtectedRoute>} />
          <Route path="/faculty/announcements" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyAnnouncements /></ProtectedRoute>} />
          <Route path="/faculty/courses" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><CourseCreator /></ProtectedRoute>} />
          <Route path="/faculty/exams" element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><ExamCreator /></ProtectedRoute>} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><ManageUsers /></ProtectedRoute>} />
          <Route path="/admin/classes" element={<ProtectedRoute allowedRoles={['admin']}><ManageClasses /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><PlatformAnalytics /></ProtectedRoute>} />
          <Route path="/admin/ai-usage" element={<ProtectedRoute allowedRoles={['admin']}><AIUsageTelemetry /></ProtectedRoute>} />

          {/* Shared routes */}
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Fallback redirection */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
