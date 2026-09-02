import {
  readSettings,
  saveSettings,
  SettingsStoreError,
  SettingsValidationError,
} from "@/lib/settings-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await readSettings());
  } catch (error) {
    console.error("Unable to read settings", error);
    return Response.json(
      { error: "Settings could not be read. Check data/settings.json and try again." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    return Response.json(await saveSettings(input));
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof SettingsStoreError
      ? "Settings could not be saved. Check data/settings.json and try again."
      : "Unable to save settings. Try again.";
    console.error("Unable to save settings", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
