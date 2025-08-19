import { LucideMessageSquareWarning } from "lucide-react";
import { cloneElement, ReactElement, HTMLAttributes } from "react";

type PlaceholderProps = {
  label: string;
  icon?: ReactElement;
  button?: ReactElement<HTMLAttributes<HTMLElement>>;
};

const Placeholder = ({
  label,
  icon = <LucideMessageSquareWarning />,
  button = <div />,
}: PlaceholderProps) => {
  return (
    <div className="flex-1 self-center flex flex-col items-center justify-center gap-y-2">
       {cloneElement(icon, {
        className: "w-16 h-16 text-gray-400",
        "aria-hidden": "true"
      } as React.SVGProps<SVGSVGElement>)}
      <h2 className="text-lg text-center">{label}</h2>
      {cloneElement(button, {
        className: "h-10",
      })}
    </div>
  );
};

export { Placeholder };