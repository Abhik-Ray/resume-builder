const safeImportEnvVar = (name: string) => {
    let envVar: string;
    try {
        envVar = import.meta.env[name];
    } catch {
        throw new Error(`var ${name} failed to be imported from the environment`);
    }
    return envVar;
}

export const config = {
    GeminiKey: safeImportEnvVar('VITE_GEMINI_API_KEY')
}