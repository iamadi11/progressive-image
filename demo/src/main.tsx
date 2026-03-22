import React from 'react';
import ReactDOM from 'react-dom/client';
import { ComparisonDashboard } from './ComparisonDashboard';
import { getTestComponent } from './TestRoutes';
import './index.css';

const pathname = window.location.pathname;
const TestComponent = getTestComponent(pathname);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {TestComponent ? React.createElement(TestComponent) : <ComparisonDashboard />}
  </React.StrictMode>
);
