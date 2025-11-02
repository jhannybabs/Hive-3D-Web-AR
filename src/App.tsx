import {BrowserRouter as Router, Route, Routes} from "react-router-dom";

// Pages
import Camera from "./pages/Camera";

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Camera />} />
      </Routes>
    </Router>
  );
}

export default App;