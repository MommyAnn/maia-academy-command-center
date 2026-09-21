import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { StudentStoreProvider } from "@/data/studentStore";
import { FinanceStoreProvider } from "@/data/financeStore";
import { StaffStoreProvider } from "@/data/staffStore";
import { InventoryStoreProvider } from "@/data/inventoryStore";
import { TrainingStoreProvider } from "@/data/trainingStore";
import { TaskStoreProvider } from "@/data/taskStore";
import { AppRoutes } from "@/router/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudentStoreProvider>
          <FinanceStoreProvider>
            <StaffStoreProvider>
              <InventoryStoreProvider>
                <TrainingStoreProvider>
                  <TaskStoreProvider>
                    <AppRoutes />
                  </TaskStoreProvider>
                </TrainingStoreProvider>
              </InventoryStoreProvider>
            </StaffStoreProvider>
          </FinanceStoreProvider>
        </StudentStoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
