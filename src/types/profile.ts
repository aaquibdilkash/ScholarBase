/**
 * Shared profile types used in profile pages and components.
 */

export interface ProfileData {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
    bio: string | null;
    githubUrl: string | null;
    orcidId: string | null;
    linkedinUrl: string | null;
    googleScholarUrl: string | null;
}
