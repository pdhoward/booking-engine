"use client"
import Image from "next/image";
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="https://res.cloudinary.com/stratmachine/image/upload/v1592332360/machine/icon-384x384_liietq.png"
          alt="Machine logo"
          width={80}
          height={80}
          priority
        />
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            AI Booking Engine. {" "}
          </li>
          <li className="tracking-[-.01em]">
            Get Started by creating your Calendar Rules
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
             href="/dashboard" 
              onClick={(e) => {
                e.preventDefault(); // Prevent default <a> behavior
                router.push('/dashboard'); 
              }}
          >           
            Calendar
          </a>
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
             href="/inventory" 
              onClick={(e) => {
                e.preventDefault(); // Prevent default <a> behavior
                router.push('/inventory'); 
              }}
          >           
            Inventory
          </a>
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
             href="/test" 
              onClick={(e) => {
                e.preventDefault(); // Prevent default <a> behavior
                router.push('/test'); 
              }}
          >           
            Reservation 
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://www.strategicmachines.ai/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center"> 
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://www.strategicmachines.ai/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="https://res.cloudinary.com/stratmachine/image/upload/v1592332360/machine/icon-384x384_liietq.png"
            alt="Machine icon"
            width={16}
            height={16}
          />
          Go to Strategic Machines →
        </a>
      </footer>
    </div>
  );
}
