import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Placeholder for routes delivered by later sub-tasks. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="container-page flex flex-col items-center gap-3 py-24 text-center">
      <BookOpen className="h-12 w-12 text-brand-600" />
      <h1 className="text-3xl">{title}</h1>
      <p className="max-w-md text-stone-600">This page is coming in an upcoming milestone.</p>
      <Link to="/" className="btn-primary mt-2">Back to home</Link>
    </div>
  );
}
