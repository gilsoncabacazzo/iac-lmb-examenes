import js from "@eslint/js";
import globals from "globals";
import eslintPluginImport from "eslint-plugin-import"; // ◄ 1. Importás el plugin

export default [
    js.configs.recommended,
    {
        plugins: {
            import: eslintPluginImport 
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
                // Agrega aquí variables globales si tu entorno inyecta alguna de forma externa
            },
        },
        rules: {
            "no-undef": "error",       // <-- ESTO detendrá el pipeline si 'responder' no está declarada
            "no-unused-vars": "warn",   // Te avisa si declaras variables que no usas
            "import/named": "error"
        },
    },
];