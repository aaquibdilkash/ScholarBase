import { createJournal, updateJournal } from "@/app/actions/journals";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export type JournalFormValues = {
  title: string;
  issn: string;
  impactFactor: string;
  scopus: string;
  abdcCategory: string;
  publisher: string;
  website: string;
  about: string;
};

export default function JournalForm({
  mode,
  journalId,
  initialValues,
}: {
  mode: "create" | "edit";
  journalId?: string;
  initialValues?: Partial<JournalFormValues>;
}) {
  const values: JournalFormValues = {
    title: initialValues?.title ?? "",
    issn: initialValues?.issn ?? "",
    impactFactor: initialValues?.impactFactor ?? "",
    scopus: initialValues?.scopus ?? "",
    abdcCategory: initialValues?.abdcCategory ?? "",
    publisher: initialValues?.publisher ?? "",
    website: initialValues?.website ?? "",
    about: initialValues?.about ?? "",
  };

  // 👇 1. Define the Server Action cleanly OUTSIDE of the JSX
  async function handleEditAction(formData: FormData) {
    "use server";
    await updateJournal(formData, String(journalId));
  }

  // 👇 2. Decide which action to use before the return statement
  const formAction = mode === "edit" ? handleEditAction : createJournal;

  return (
    <form
      action={formAction}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">Journal Name</label>
        <input
          name="title"
          placeholder="e.g., Journal of Financial Economics"
          className="sb-input"
          required
          defaultValue={values.title}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">ISSN</label>
          <input
            name="issn"
            placeholder="e.g., 0304-405X"
            className="sb-input"
            defaultValue={values.issn}
          />
        </div>
        <div>
          <label className="sb-label">Impact Factor</label>
          <input
            name="impactFactor"
            placeholder="e.g., 5.467"
            className="sb-input"
            defaultValue={values.impactFactor}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Scopus</label>
          <input
            name="scopus"
            placeholder="e.g., Q1"
            className="sb-input"
            defaultValue={values.scopus}
          />
        </div>
        <div>
          <label className="sb-label">ABDC Category</label>
          <input
            name="abdcCategory"
            placeholder="e.g., A*"
            className="sb-input"
            defaultValue={values.abdcCategory}
          />
        </div>
      </div>

      <div>
        <label className="sb-label">Publisher</label>
        <input
          name="publisher"
          placeholder="e.g., Elsevier"
          className="sb-input"
          defaultValue={values.publisher}
        />
      </div>

      <div>
        <label className="sb-label">Website</label>
        <input
          name="website"
          placeholder="https.www.sciencedirect.com/journal/journal-of-financial-economics"
          className="sb-input"
          defaultValue={values.website}
        />
      </div>

      <div>
        <label className="sb-label">About</label>
        <textarea
          name="about"
          placeholder="Briefly describe the journal and its focus..."
          className="sb-input h-32"
          defaultValue={values.about}
        />
      </div>

      <SubmitBtn className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Add Journal"}
      </SubmitBtn>
    </form>
  );
}
