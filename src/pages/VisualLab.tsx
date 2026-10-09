import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/learning/primitives";
import { LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";

/**
 * The free-explore lab.
 *
 * Same component as a lesson deep link mounts, with the module picker left on:
 * `/visual/:visualKey` opens one operation because a lesson asked for it, this
 * page opens all of them because nobody did.
 *
 * `lazy()` on the same specifier as `VisualLearning.tsx` uses means three.js is
 * one chunk shared between both routes — a student who only browses the gallery
 * never downloads the renderer.
 */

const DsaLab = lazy(() => import("@/components/visual/lab/DsaLab"));

const VisualLab = () => (
  <div className="space-y-5">
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link to="/visual">
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
        All visualisations
      </Link>
    </Button>

    <PageHeader
      eyebrow="Visual learning"
      title="The lab"
      description="Twenty-two structures and a hundred and forty operations. Put your own numbers in, pick an operation, and step through what the algorithm actually does to them — the animation is generated from the run, so changing the input changes the picture."
    />

    <Suspense fallback={<LoadingState label="Loading the lab…" />}>
      <DsaLab />
    </Suspense>
  </div>
);

export default VisualLab;
