import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Page() {
  return (
    <main>
      <h1>Zack Grogan</h1>
      <p className="role">Developer</p>

      <p>
        This is my personal site. I build software for myself and my own
        projects.
      </p>

      <p className="note">
        I am one person — a developer. I am not a development group, agency,
        studio, consultancy, or team you can hire.
      </p>

      <p className="tools">
        Private toolbox:{" "}
        <a href="https://loom.grogan.dev">Loom</a>
      </p>
    </main>
  );
}
