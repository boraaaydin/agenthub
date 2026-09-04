import { LifecycleLogStoreError } from "@/lib/lifecycle-log-store";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import {
  createWorkitem,
  listProjectWorkitems,
  searchProjectWorkitems,
  WorkitemStoreError,
  WorkitemValidationError,
  WORKITEMS_PAGE_SIZE,
} from "@/lib/workitems-store";
import { isWorkitemStatus } from "@/lib/workitem-filters";

export const dynamic = "force-dynamic";

function pageFromRequest(request: Request): number {
  const value = new URL(request.url).searchParams.get("page");
  const page = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function statusFromRequest(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  return isWorkitemStatus(status) ? status : undefined;
}

function searchFromRequest(request: Request): string | null {
  return new URL(request.url).searchParams.get("q");
}

function excludedStatusesFromRequest(request: Request) {
  return [...new Set(
    new URL(request.url).searchParams
      .getAll("excludeStatus")
      .filter(isWorkitemStatus),
  )];
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/projects/[id]/workitems">,
) {
  const { id } = await context.params;

  try {
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const query = searchFromRequest(request);
    if (query !== null) {
      const workitems = await searchProjectWorkitems(
        id,
        query,
        excludedStatusesFromRequest(request),
      );
      return Response.json({
        workitems,
        page: 1,
        pageSize: workitems.length,
        total: workitems.length,
        totalPages: 1,
      });
    }

    const status = statusFromRequest(request);
    return Response.json(await listProjectWorkitems(id, {
      page: pageFromRequest(request),
      pageSize: WORKITEMS_PAGE_SIZE,
      statuses: status ? [status] : undefined,
    }));
  } catch (error) {
    console.error("Unable to list project workitems", error);
    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and try again."
      : "Workitem data could not be read. Check data/workitems.json and try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/projects/[id]/workitems">,
) {
  const { id } = await context.params;
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const workitem = await createWorkitem(id, input);
    return Response.json(workitem, { status: 201 });
  } catch (error) {
    if (error instanceof WorkitemValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof LifecycleLogStoreError
      ? "The workitem was saved, but its lifecycle event could not be written. Check data/lifecycle-log.json before retrying."
      : error instanceof ProjectStoreError
        ? "Project data could not be read. Check data/projects.json and try again."
        : error instanceof WorkitemStoreError
          ? "Workitem data could not be written. Check data/workitems.json and try again."
          : "Unable to create the workitem. Try again.";
    console.error("Unable to create project workitem", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
