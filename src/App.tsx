import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { StudentStoreProvider } from "@/data/studentStore";
import { AppRoutes } from "@/router/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudentStoreProvider>
          <AppRoutes />
        </StudentStoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
