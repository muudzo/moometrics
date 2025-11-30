import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
    username: string;
    name: string;
}

interface AuthContextType {
    user: User | null;
    login: (username: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // Check for stored user on mount
        const storedUser = localStorage.getItem('moometrics_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const login = async (username: string) => {
        // Mock login - accept any username
        // In a real app, you would validate credentials here
        const newUser = { username, name: username };
        setUser(newUser);
        localStorage.setItem('moometrics_user', JSON.stringify(newUser));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('moometrics_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
