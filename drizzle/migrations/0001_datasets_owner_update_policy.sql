DROP POLICY IF EXISTS "Owner updates datasets" ON public.datasets;
CREATE POLICY "Owner updates datasets"
ON public.datasets
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());