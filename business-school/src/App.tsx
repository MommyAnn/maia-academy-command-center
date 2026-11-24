import { Route, Routes } from "react-router-dom";
import { PublicLayout } from "./components/Layout";
import Home from "./pages/public/Home";
import Courses from "./pages/public/Courses";
import CourseDetail from "./pages/public/CourseDetail";
import Store from "./pages/public/Store";
import Testimonials from "./pages/public/Testimonials";
import Contact from "./pages/public/Contact";
import { Login, NotFound, Policy, Register } from "./pages/public/Auth";
import { Learn, PortalAccount, PortalDashboard, PortalLayout, PortalSchedule, RequireAuth } from "./pages/portal/Portal";
import {
  AdminInquiries,
  AdminLayout,
  AdminOverview,
  AdminProgram,
  AdminSchedules,
  AdminSettings,
  AdminStore,
  AdminTestimonials,
} from "./pages/admin/Admin";
import { AdminCourseEditor, AdminCourses } from "./pages/admin/AdminCourses";
import { AdminStudentDetail, AdminStudents } from "./pages/admin/AdminStudents";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:slug" element={<CourseDetail />} />
        <Route path="store" element={<Store />} />
        <Route path="testimonials" element={<Testimonials />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="policies/:key" element={<Policy />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="portal" element={<PortalLayout />}>
          <Route index element={<PortalDashboard />} />
          <Route path="schedule" element={<PortalSchedule />} />
          <Route path="account" element={<PortalAccount />} />
          <Route path="learn/:slug" element={<Learn />} />
          <Route path="learn/:slug/:lessonId" element={<Learn />} />
        </Route>
      </Route>

      <Route element={<RequireAuth admin />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="courses" element={<AdminCourses />} />
          <Route path="courses/:id" element={<AdminCourseEditor />} />
          <Route path="program" element={<AdminProgram />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="students/:id" element={<AdminStudentDetail />} />
          <Route path="schedules" element={<AdminSchedules />} />
          <Route path="store" element={<AdminStore />} />
          <Route path="testimonials" element={<AdminTestimonials />} />
          <Route path="inquiries" element={<AdminInquiries />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>
    </Routes>
  );
}
