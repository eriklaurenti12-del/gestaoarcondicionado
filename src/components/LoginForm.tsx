
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import InstallButton from "@/components/InstallButton";

interface LoginFormProps {
  onLogin: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const { theme, toggleTheme } = useTheme();
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const handleLogin = () => {
    if (loginUser === "adm" && loginPass === "00") {
      onLogin();
    } else {
      alert("Login inválido");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Sistema de Gestão de Eletrônicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              type="text"
              placeholder="Digite seu usuário"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={handleLogin}>
            Entrar
          </Button>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
            <InstallButton />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Criado por Erik Laurenti
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
