import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Platform from "./pages/Platform.jsx";
import Aria from "./pages/Aria.jsx";
import Research from "./pages/Research.jsx";
import ResearchItem from "./pages/ResearchItem.jsx";
import Company from "./pages/Company.jsx";
import BookCall from "./pages/BookCall.jsx";
import SignIn from "./pages/SignIn.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="platform" element={<Platform />} />
        <Route path="aria" element={<Aria />} />
        <Route path="research" element={<Research />} />
        <Route path="research/:slug" element={<ResearchItem />} />
        <Route path="company" element={<Company />} />
        <Route path="book-a-call" element={<BookCall />} />
        <Route path="sign-in" element={<SignIn />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
