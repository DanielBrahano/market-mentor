import React, { Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { SkeletonCard } from "./components/ui";

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Screener = React.lazy(() => import("./pages/Screener"));
const StockDetail = React.lazy(() => import("./pages/StockDetail"));
const Patterns = React.lazy(() => import("./pages/Patterns"));
const Learn = React.lazy(() => import("./pages/Learn"));
const Watchlists = React.lazy(() => import("./pages/Watchlists"));
const Alerts = React.lazy(() => import("./pages/Alerts"));
const Settings = React.lazy(() => import("./pages/Settings"));
const TrackRecord = React.lazy(() => import("./pages/TrackRecord"));

function Fallback() {
  return (
    <div className="grid cols-2">
      <SkeletonCard lines={4} />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <Shell>
      <Suspense fallback={<Fallback />} key={location.pathname.split("/")[1]}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/stock/:symbol" element={<StockDetail />} />
          <Route path="/patterns" element={<Patterns />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/watchlists" element={<Watchlists />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/track-record" element={<TrackRecord />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
