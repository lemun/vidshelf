import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './components/AuthProvider';
import { Header } from './components/Header';
import { RequireAuth } from './components/RequireAuth';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UploadPage } from './pages/UploadPage';
import { WatchPage } from './pages/WatchPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-white text-zinc-900">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/watch/:id" element={<WatchPage />} />
              <Route
                path="/upload"
                element={
                  <RequireAuth>
                    <UploadPage />
                  </RequireAuth>
                }
              />
              <Route path="/signin" element={<AuthPage key="signin" mode="signin" />} />
              <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
