import { createResult, updateResult } from "@/app/actions/results";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export type ResultFormValues = {
  title: string;
  type: string;
  category: string;
  conductingBody: string;
  session: string;
  description: string;
  notificationLink: string;
  resultLink: string;
};

const RESULT_TYPES = [
  { value: "EXAM", label: "Exam Result" },
  { value: "ADMISSION", label: "Admission Result" },
  { value: "VACANCY", label: "Vacancy Result" },
  { value: "EVENT", label: "Event Result" },
  { value: "OTHER", label: "Other Result" },
];

export default function ResultForm({
  mode,
  resultId,
  initialValues,
}: {
  mode: "create" | "edit";
  resultId?: string;
  initialValues?: Partial<ResultFormValues>;
}) {
  const values: ResultFormValues = {
    title: initialValues?.title ?? "",
    type: initialValues?.type ?? "EXAM",
    category: initialValues?.category ?? "",
    conductingBody: initialValues?.conductingBody ?? "",
    session: initialValues?.session ?? "",
    description: initialValues?.description ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    resultLink: initialValues?.resultLink ?? "",
  };

  async function handleEditAction(formData: FormData) {
    "use server";
    await updateResult(formData, String(resultId));
  }

  const formAction = mode === "edit" ? handleEditAction : createResult;

  return (
    <form
      action={formAction}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">Title</label>
        <input
          name="title"
          placeholder="e.g., UGC NET June 2024 Results Declared"
          className="sb-input"
          required
          defaultValue={values.title}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Result Type</label>
          <select
            name="type"
            className="sb-input"
            required
            defaultValue={values.type}
          >
            {RESULT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sb-label">Category (Optional)</label>
          <input
            name="category"
            placeholder="e.g., NET, JRF, SET, GATE"
            className="sb-input"
            defaultValue={values.category}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Conducting Body (Optional)</label>
          <input
            name="conductingBody"
            placeholder="e.g., UGC, NTA, CBSE"
            className="sb-input"
            defaultValue={values.conductingBody}
          />
        </div>
        <div>
          <label className="sb-label">Session (Optional)</label>
          <input
            name="session"
            placeholder="e.g., June 2024, December 2024"
            className="sb-input"
            defaultValue={values.session}
          />
        </div>
      </div>

      <div>
        <label className="sb-label">Description / Details</label>
        <textarea
          name="description"
          placeholder="Provide details about the result, cut-off marks, important dates, etc."
          className="sb-input h-32"
          required
          defaultValue={values.description}
        />
      </div>

      <div>
        <label className="sb-label">Official Notification URL (Optional)</label>
        <input
          type="url"
          name="notificationLink"
          placeholder="https://ugc.ac.in/notification.pdf"
          className="sb-input"
          defaultValue={values.notificationLink}
        />
      </div>

      <div>
        <label className="sb-label">Result / Outcome URL (Optional)</label>
        <input
          type="url"
          name="resultLink"
          placeholder="https://ntaresults.nic.in/..."
          className="sb-input"
          defaultValue={values.resultLink}
        />
      </div>

      <SubmitBtn className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Publish Result"}
      </SubmitBtn>
    </form>
  );
}
