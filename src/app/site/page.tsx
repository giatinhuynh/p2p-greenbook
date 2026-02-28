export default async function Home() {
  return (
    <>
      <section className="h-full w-full md:pt-44 mt-[-125px] relative flex items-center justify-center flex-col ">
        <div className="bg-gradient-to-r from-primary to-secondary-foreground text-transparent bg-clip-text relative">
          <h1 className="text-9xl font-bold text-center">
            GreenBook
          </h1>
        </div>
        <div className="flex justify-center items-center relative md:mt-[-70px]">
          <div className="bottom-0 top-[50%] bg-gradient-to-t dark:from-background left-0 right-0 absolute z-10"></div>
        </div>
      </section>
    </>
  )
}