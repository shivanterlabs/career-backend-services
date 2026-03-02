import { useState } from "react";
import LoginPage from "./pages/LoginPage";
import TestsPage from "./pages/TestsPage";
import QuestionsPage from "./pages/QuestionsPage";

export default function App() {
  const [admin, setAdmin]               = useState(null);        // null = not logged in
  const [selectedTest, setSelectedTest] = useState(null);        // null = tests list

  const handleLogin  = (adminData) => setAdmin(adminData);
  const handleLogout = () => { setAdmin(null); setSelectedTest(null); };

  if (!admin) return <LoginPage onLogin={handleLogin} />;

  if (selectedTest) {
    return (
      <QuestionsPage
        admin={admin}
        test={selectedTest}
        onBack={() => setSelectedTest(null)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <TestsPage
      admin={admin}
      onSelectTest={setSelectedTest}
      onLogout={handleLogout}
    />
  );
}
