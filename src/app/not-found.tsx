import Link from "next/link";
import { Placeholder } from "@/components/ui/placeholder";
import { Button } from "@/components/ui/button";
import { homePath } from "@/lib/paths";

export default function NotFound(){
    return (
        <Placeholder
          label="Not Found"
          button={
            <Button asChild variant="outline">
              <Link href={homePath()}>Return Home</Link>
            </Button>
          }
        />
      );
}