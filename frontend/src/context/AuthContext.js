import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");

        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch (err) {
                // Corrupted/invalid value (e.g. the literal string "undefined"
                // from a previous broken save) — wipe it instead of crashing
                // the whole app on every load.
                console.warn("Corrupted auth data in localStorage, clearing it.", err);
                localStorage.removeItem("token");
                localStorage.removeItem("user");
            }
        }
        setLoading(false);
    }, []);

    // Cross-tab sync: the storage event only fires in OTHER tabs when
    // localStorage changes here (never fires in the tab that made the
    // change itself). So if this tab is sitting on /login and another
    // tab logs in, this one picks it up and GuestRoute redirects it away
    // — no manual refresh needed. Same mechanism catches logout too:
    // if another tab logs out, this tab (sitting on a protected page)
    // gets bounced to /login automatically.
    useEffect(() => {
        function handleStorageChange(e) {
            if (e.key !== "token" && e.key !== "user") return;

            const storedToken = localStorage.getItem("token");
            const storedUser = localStorage.getItem("user");

            if (storedToken && storedUser) {
                try {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                } catch (err) {
                    console.warn("Corrupted auth data from storage event, ignoring.", err);
                }
            } else {
                // Other tab logged out — clear here too.
                setToken(null);
                setUser(null);
            }
        }

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const login = (userData, authToken) => {
        // Guard against ever re-introducing the bug: don't persist if either
        // value is missing (this is exactly what caused JSON.stringify(undefined)
        // -> the literal string "undefined" being saved in the first place).
        if (!userData || !authToken) {
            console.error("login() called without complete user/token data — not persisting.", { userData, authToken });
            return;
        }

        setUser(userData);
        setToken(authToken);
        localStorage.setItem("token", authToken);
        localStorage.setItem("user", JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);