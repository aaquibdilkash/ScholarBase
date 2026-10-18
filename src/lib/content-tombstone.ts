/** Public visibility predicate shared by detail queries and list loaders. */
export function engagedContentWhere(...counterKeys: string[]) {
  return {
    OR: [
      { isDeleted: false },
      {
        isDeleted: true,
        OR: counterKeys.map((key) => ({ [key]: { gt: 0 } })),
      },
    ],
  };
}
