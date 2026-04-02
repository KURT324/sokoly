import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotifications } from './hooks/useNotifications';
import { UserRole } from '@eduplatform/shared';
import { PrivateRoute } from './components/PrivateRoute';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { AdminUsersPage } from './pages/admin/UsersPage';
import { AdminCohortsPage } from './pages/admin/CohortsPage';
import { TeacherDashboardPage } from './pages/teacher/DashboardPage';
import { TeacherDaysPage } from './pages/teacher/DaysPage';
import { TeacherDayDetailPage } from './pages/teacher/DayDetailPage';
import { StudentDashboardPage } from './pages/student/DashboardPage';
import { StudentDayDetailPage } from './pages/student/DayDetailPage';
import { StudentTestPage } from './pages/student/TestPage';
import { TeacherTestsPage } from './pages/teacher/TestsPage';
import { TestCreatePage } from './pages/teacher/TestCreatePage';
import { TeacherTestResultsPage } from './pages/teacher/TestResultsPage';
import { TeacherCardsPage } from './pages/teacher/CardsPage';
import { StudentCardsPage } from './pages/student/CardsPage';
import { GroupChatPage } from './pages/chat/GroupChatPage';
import { TeacherChatPage } from './pages/chat/TeacherChatPage';
import { AdminChatPage } from './pages/chat/AdminChatPage';
import { TeacherAnalyticsPage } from './pages/teacher/AnalyticsPage';
import { AdminAnalyticsPage } from './pages/admin/AnalyticsPage';
import { MaterialLibraryPage } from './pages/teacher/MaterialLibraryPage';
import { TeacherStudentsPage } from './pages/teacher/StudentsPage';

const queryClient = new QueryClient();

function AppInner() {
  useNotifications();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
      <AppInner />
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/change-password" element={
            <PrivateRoute><ChangePasswordPage /></PrivateRoute>
          } />

          {/* Admin */}
          <Route path="/admin/dashboard" element={
            <PrivateRoute allowedRoles={[UserRole.ADMIN]}><AdminDashboardPage /></PrivateRoute>
          } />
          <Route path="/admin/users" element={
            <PrivateRoute allowedRoles={[UserRole.ADMIN]}><AdminUsersPage /></PrivateRoute>
          } />
          <Route path="/admin/cohorts" element={
            <PrivateRoute allowedRoles={[UserRole.ADMIN]}><AdminCohortsPage /></PrivateRoute>
          } />

          {/* Teacher (Admin can also view) */}
          <Route path="/teacher/dashboard" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER]}><TeacherDashboardPage /></PrivateRoute>
          } />
          <Route path="/teacher/days" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}><TeacherDaysPage /></PrivateRoute>
          } />
          <Route path="/teacher/days/:dayId" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}><TeacherDayDetailPage /></PrivateRoute>
          } />

          {/* Teacher: tests */}
          <Route path="/teacher/tests" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}><TeacherTestsPage /></PrivateRoute>
          } />
          <Route path="/teacher/tests/create" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}><TestCreatePage /></PrivateRoute>
          } />
          <Route path="/teacher/tests/:testId/results" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}><TeacherTestResultsPage /></PrivateRoute>
          } />

          {/* Teacher: cards */}
          <Route path="/teacher/cards" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}><TeacherCardsPage /></PrivateRoute>
          } />

          {/* Teacher: material library */}
          <Route path="/teacher/library" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}><MaterialLibraryPage /></PrivateRoute>
          } />

          {/* Teacher: students roster */}
          <Route path="/teacher/students" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}><TeacherStudentsPage /></PrivateRoute>
          } />

          {/* Student */}
          <Route path="/student/dashboard" element={
            <PrivateRoute allowedRoles={[UserRole.STUDENT]}><StudentDashboardPage /></PrivateRoute>
          } />
          <Route path="/student/days/:dayId" element={
            <PrivateRoute allowedRoles={[UserRole.STUDENT]}><StudentDayDetailPage /></PrivateRoute>
          } />
          <Route path="/student/tests/:testId" element={
            <PrivateRoute allowedRoles={[UserRole.STUDENT]}><StudentTestPage /></PrivateRoute>
          } />
          <Route path="/student/cards" element={
            <PrivateRoute allowedRoles={[UserRole.STUDENT]}><StudentCardsPage /></PrivateRoute>
          } />

          {/* Analytics */}
          <Route path="/teacher/analytics" element={
            <PrivateRoute allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}><TeacherAnalyticsPage /></PrivateRoute>
          } />
          <Route path="/admin/analytics" element={
            <PrivateRoute allowedRoles={[UserRole.ADMIN]}><AdminAnalyticsPage /></PrivateRoute>
          } />

          {/* Chats */}
          <Route path="/chat/group" element={
            <PrivateRoute><GroupChatPage /></PrivateRoute>
          } />
          <Route path="/chat/teacher" element={
            <PrivateRoute><TeacherChatPage /></PrivateRoute>
          } />
          <Route path="/chat/admin" element={
            <PrivateRoute><AdminChatPage /></PrivateRoute>
          } />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
