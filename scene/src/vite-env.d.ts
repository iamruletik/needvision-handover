/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly PORT?: string;
    readonly PUBLIC_ENV?: string;
    readonly HOST?: string;
    readonly PUBLIC_API_HOST?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
