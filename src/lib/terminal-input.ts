export function terminalSubmission(text: string): [paste: string, submit: string] {
  const normalizedText = text.replace(/\r\n|\r/g, "\n");
  return [`\x1b[200~${normalizedText}\x1b[201~`, "\r"];
}
