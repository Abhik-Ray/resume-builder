export const summaryResponseSchema = {
        summary: {
        content: { "type": "STRING", "description": "The main response" },
    },
}
export const responseSchema = {
    experienceSection: {
        content: { "type": "STRING", "description": "The main bullet point text" },
    },
    skillsSection: {
        type: "ARRAY",
        content: { "type": "STRING", "description": "The exact skill" },
    }
}