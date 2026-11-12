// Curated models with documented Responses API web-search support.
export const openAiModels = [
 {id:'gpt-6-luna',label:'GPT-6 Luna — แนะนำ: ประหยัดค่าใช้จ่าย'},
 {id:'gpt-6.1-sol',label:'GPT-6.1 Sol — งานค้นข้อมูลและเรียบเรียงที่ซับซ้อน'},
] as const;
export const defaultOpenAiModel = openAiModels[0].id;
