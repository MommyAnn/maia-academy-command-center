import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { StudentStoreProvider } from "@/data/studentStore";
import { FinanceStoreProvider } from "@/data/financeStore";
import { AppRoutes } from "@/router/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudentStoreProvider>
          <FinanceStoreProvider>
            <AppRoutes />
          </FinanceStoreProvider>
        </StudentStoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
