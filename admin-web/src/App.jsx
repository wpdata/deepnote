import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Questions from './pages/Questions'
import Upload from './pages/Upload'
import Statistics from './pages/Statistics'
import UserLogs from './pages/UserLogs'
import { checkLoginStatus } from './utils/cloudbase'

// 路由守卫组件
const PrivateRoute = ({ children }) => {
  const isLoggedIn = checkLoginStatus()
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="questions" element={<Questions />} />
            <Route path="upload" element={<Upload />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="logs" element={<UserLogs />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
