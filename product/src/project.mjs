export function projectPrompt(settings) {
 const fields=[['goal','목표'],['audience','대상'],['technology','기술'],['exclusions','제외']];
 return fields.filter(([key])=>settings[key]?.trim()).map(([key,label])=>`${label}: ${settings[key].trim()}`).join('\n');
}
