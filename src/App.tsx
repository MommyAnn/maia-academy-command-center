import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { VideoCreatorApp } from "@/videoCreator/VideoCreatorApp";
import { AuthProvider } from "@/context/AuthContext";
import { StudentStoreProvider } from "@/data/studentStore";
import { FinanceStoreProvider } from "@/data/financeStore";
import { StaffStoreProvider } from "@/data/staffStore";
import { InventoryStoreProvider } from "@/data/inventoryStore";
import { TrainingStoreProvider } from "@/data/trainingStore";
import { TaskStoreProvider } from "@/data/taskStore";
import { PortalStoreProvider } from "@/data/portalStore";
import { MasterBrainStoreProvider } from "@/data/masterBrainStore";
import { LmsStoreProvider } from "@/data/lmsStore";
import { FeedbackStoreProvider } from "@/data/feedbackStore";
import { WebinarStoreProvider } from "@/data/webinarStore";
import { CommunicationsStoreProvider } from "@/data/communicationsStore";
import { AiToolsStoreProvider } from "@/data/aiToolsStore";
import { AppRoutes } from "@/router/AppRoutes";

// Set VITE_ROOT_APP=studio for a deployment that is ONLY the AI Video Creator.
const ROOT_IS_STUDIO = import.meta.env.VITE_ROOT_APP === "studio";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* M.A.I.A. AI Video Creator — the real, backend-connected customer app. Kept outside the demo
            app's localStorage providers on purpose: it never reads or writes demo data. */}
        <Route path="/studio/*" element={<VideoCreatorApp />} />
        {ROOT_IS_STUDIO && <Route path="*" element={<Navigate to="/studio" replace />} />}
        <Route path="*" element={<CommandCenterApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function CommandCenterApp() {
  return (
      <AuthProvider>
        <StudentStoreProvider>
          <FinanceStoreProvider>
            <PortalStoreProvider>
              <MasterBrainStoreProvider>
                <AiToolsStoreProvider>
                  <LmsStoreProvider>
                    <WebinarStoreProvider>
                      <CommunicationsStoreProvider>
                        <FeedbackStoreProvider>
                          <StaffStoreProvider>
                            <InventoryStoreProvider>
                              <TrainingStoreProvider>
                                <TaskStoreProvider>
                                  <AppRoutes />
                                </TaskStoreProvider>
                              </TrainingStoreProvider>
                            </InventoryStoreProvider>
                          </StaffStoreProvider>
                        </FeedbackStoreProvider>
                      </CommunicationsStoreProvider>
                    </WebinarStoreProvider>
                  </LmsStoreProvider>
                </AiToolsStoreProvider>
              </MasterBrainStoreProvider>
            </PortalStoreProvider>
          </FinanceStoreProvider>
        </StudentStoreProvider>
      </AuthProvider>
  );
}

export default App;
