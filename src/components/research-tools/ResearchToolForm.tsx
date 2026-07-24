import {
  createResearchTool,
  updateResearchTool,
} from "@/app/actions/researchTools";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export type ResearchToolFormValues = {
  name: string;
  website: string;
  use: string;
  description: string;
};

export default function ResearchToolForm({
  mode,
  toolId,
  initialValues,
}: {
  mode: "create" | "edit";
  toolId?: string;
  initialValues?: Partial<ResearchToolFormValues>;
}) {
  const values: ResearchToolFormValues = {
    name: initialValues?.name ?? "",
    website: initialValues?.website ?? "",
    use: initialValues?.use ?? "",
    description: initialValues?.description ?? "",
  };

  // 👇 1. Define the Server Action cleanly OUTSIDE of the JSX
  async function handleEditAction(formData: FormData) {
    "use server";
    await updateResearchTool(formData, String(toolId));
  }

  // 👇 2. Decide which action to use before the return statement
  const formAction = mode === "edit" ? handleEditAction : createResearchTool;

  return (
    <form
      action={formAction}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">Tool Name</label>
        <input
          name="name"
          placeholder="e.g., Zotero"
          className="sb-input"
          required
          defaultValue={values.name}
        />
      </div>

      <div>
        <label className="sb-label">Website</label>
        <input
          name="website"
          placeholder="e.g., https://www.zotero.org/"
          className="sb-input"
          required
          defaultValue={values.website}
        />
      </div>

      <div>
        <label className="sb-label">Primary Use</label>
        <input
          name="use"
          placeholder="e.g., Reference Management"
          className="sb-input"
          required
          defaultValue={values.use}
        />
      </div>

      <div>
        <label className="sb-label">Description</label>
        <textarea
          name="description"
          placeholder="Briefly describe the tool and its features..."
          className="sb-input h-32"
          required
          defaultValue={values.description}
        />
      </div>

      <SubmitBtn className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Add Research Tool"}
      </SubmitBtn>
    </form>
  );
}
