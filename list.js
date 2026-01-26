import { GoogleGenAI } from "@google/genai";


const ai = new GoogleGenAI({
apiKey: "" ,
});


async function main() {
const models = await ai.models.list();
console.log(models);
// for (const m of models.models) {
// console.log(m.name, "→ supports:", m.supportedGenerationMethods);
// }
}


main();
