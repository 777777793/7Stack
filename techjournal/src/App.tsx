/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Interview } from "./pages/Interview";
import { Notes } from "./pages/Notes";
import { Article } from "./pages/Article";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="interview" element={<Interview />} />
          <Route path="notes" element={<Notes />} />
          <Route path="articles" element={<Home />} /> {/* Redirecting articles to home for now, as no dedicated articles list provided */}
          <Route path="article" element={<Article />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
