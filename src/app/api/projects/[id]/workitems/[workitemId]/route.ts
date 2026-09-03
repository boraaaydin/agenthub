import { LifecycleLogStoreError } from "@/lib/lifecycle-log-store";
import {
  deleteWorkitem,
  getWorkitem,
  WorkitemStoreError,
  WorkitemValidationError,
  updateWorkitem,
} from "@/lib/workitems-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/projects/[id]/workitems/[workitemId]">,
) {
  const { id, workitemId } = await context.params;
  const parsedWorkitemId = Number.parseInt(workitemId, 10);
  if (!Number.isInteger(parsedWorkitemId) || parsedWorkitemId <= 0 || String(parsedWorkitemId) !== workitemId) {
    return Response.json({ error: "Workitem not found." }, { status: 404 });
  }

  try {
    const workitem = await getWorkitem(id, parsedWorkitemId);
    if (!workitem) {
      return Response.json({ error: "Workitem not found." }, { status: 404 });
    }
    return Response.json(workitem);
  } catch (error) {
    const message = error instanceof WorkitemStoreError
      ? "Workitem data could not be read. Check data/workitems.json and try again."
      : "Unable to load the workitem. Try again.";
    console.error("Unable to read project workitem", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/projects/[id]/workitems/[workitemId]">,
) {
  const { id, workitemId } = await context.params;
  const parsedWorkitemId = Number.parseInt(workitemId, 10);
  if (!Number.isInteger(parsedWorkitemId) || parsedWorkitemId <= 0 || String(parsedWorkitemId) !== workitemId) {
    return Response.json({ error: "Workitem not found." }, { status: 404 });
  }

  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const workitem = await updateWorkitem(id, parsedWorkitemId, input);
    if (!workitem) {
      return Response.json({ error: "Workitem not found." }, { status: 404 });
    }
    return Response.json(workitem);
  } catch (error) {
    if (error instanceof WorkitemValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof LifecycleLogStoreError
      ? "The workitem status was saved, but its lifecycle event could not be written. Check data/lifecycle-log.json before retrying."
      : error instanceof WorkitemStoreError
        ? "Workitem data could not be updated. Check data/workitems.json and try again."
        : "Unable to update the workitem. Try again.";
    console.error("Unable to update project workitem", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/projects/[id]/workitems/[workitemId]">,
) {
  const { id, workitemId } = await context.params;
  const parsedWorkitemId = Number.parseInt(workitemId, 10);
  if (!Number.isInteger(parsedWorkitemId) || parsedWorkitemId <= 0 || String(parsedWorkitemId) !== workitemId) {
    return Response.json({ error: "Workitem not found." }, { status: 404 });
  }

  try {
    const workitem = await deleteWorkitem(id, parsedWorkitemId);
    if (!workitem) {
      return Response.json({ error: "Workitem not found." }, { status: 404 });
    }
    return Response.json(workitem);
  } catch (error) {
    const message = error instanceof WorkitemStoreError
      ? "Workitem data could not be updated. Check data/workitems.json and try again."
      : "Unable to delete the workitem. Try again.";
    console.error("Unable to delete project workitem", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
