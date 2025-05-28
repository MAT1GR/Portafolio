import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <Layout />
      </ThemeProvider>
    </Router>
  );
}

export default App;