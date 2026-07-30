param(
    [string]$Project = "C:\Proyectos\pdfprivado-pro"
)

$ErrorActionPreference = "Stop"
$Downloads = Join-Path $env:USERPROFILE "Downloads"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutRoot = Join-Path $Downloads "PDFPrivado-S1B8-T6A-SEMANTIC-SCHEMA-$Stamp"
New-Item -ItemType Directory -Path $OutRoot -Force | Out-Null

$Source = Get-ChildItem -LiteralPath $Downloads -Directory |
    Where-Object { $_.Name -like "PDFPrivado-S1B7-T5-HYBRID-TABLE-SHELL-*" } |
    Sort-Object LastWriteTime -Descending |
    Where-Object {
        $Result = Join-Path $_.FullName "RESULTADO.json"
        if (-not (Test-Path -LiteralPath $Result)) { return $false }
        try {
            $Data = Get-Content -LiteralPath $Result -Raw | ConvertFrom-Json
            return ($Data.pass -eq $true)
        } catch {
            return $false
        }
    } |
    Select-Object -First 1

if (-not $Source) {
    throw "No se encontro una salida T5 PASS reutilizable."
}

$PythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $PythonCommand) {
    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
}
if (-not $PythonCommand) {
    throw "No se encontro Python."
}

$PythonExe = $PythonCommand.Source
if (-not $PythonExe) {
    $PythonExe = $PythonCommand.Path
}

$Driver = Join-Path $OutRoot "t6a-semantic-schema.py"
[System.IO.File]::WriteAllBytes(
    $Driver,
    [Convert]::FromBase64String("ZnJvbSBfX2Z1dHVyZV9fIGltcG9ydCBhbm5vdGF0aW9ucwoKaW1wb3J0IGFyZ3BhcnNlCmltcG9ydCBqc29uCmltcG9ydCByZQppbXBvcnQgc3lzCmZyb20gY29sbGVjdGlvbnMgaW1wb3J0IENvdW50ZXIsIGRlZmF1bHRkaWN0CmZyb20gcGF0aGxpYiBpbXBvcnQgUGF0aAoKRVhQRUNURURfU1BFQ1MgPSAxNgoKSURFTlQgPSByZS5jb21waWxlKHIiXltBLVphLXpfXVtBLVphLXowLTlfXXswLDQ4fSQiKQpTRU1BTlRJQyA9IHJlLmNvbXBpbGUoCiAgICByIih0YWJsZXxjZWxsfHJvd3xjb2x8cmVnaW9ufGdyb3VwfGxpbmV8cGFnZXxiYm94fGJveHxyZWN0fCIKICAgIHIibGVmdHx0b3B8cmlnaHR8Ym90dG9tfHdpZHRofGhlaWdodHxvd25lcnxyb2xlfGtpbmR8dHlwZXwiCiAgICByImluZGV4fGl0ZW1zfGNoaWxkcmVufHRleHR8cnVufGJsb2NrfGZvcm18Z3JhcGhpY3x4fHkpIiwKICAgIHJlLkksCikKCmRlZiB2YWx1ZV9raW5kKHYpOgogICAgaWYgdiBpcyBOb25lOgogICAgICAgIHJldHVybiAibnVsbCIKICAgIGlmIGlzaW5zdGFuY2UodiwgYm9vbCk6CiAgICAgICAgcmV0dXJuICJib29sIgogICAgaWYgaXNpbnN0YW5jZSh2LCAoaW50LCBmbG9hdCkpOgogICAgICAgIHJldHVybiAibnVtYmVyIgogICAgaWYgaXNpbnN0YW5jZSh2LCBzdHIpOgogICAgICAgIHJldHVybiAic3RyaW5nIgogICAgaWYgaXNpbnN0YW5jZSh2LCBsaXN0KToKICAgICAgICByZXR1cm4gImFycmF5IgogICAgaWYgaXNpbnN0YW5jZSh2LCBkaWN0KToKICAgICAgICByZXR1cm4gIm9iamVjdCIKICAgIHJldHVybiB0eXBlKHYpLl9fbmFtZV9fCgpkZWYgd2Fsayh2LCBwYXRoLCB0eXBlcywga2V5X2ZyZXEpOgogICAgdHlwZXNbcGF0aF1bdmFsdWVfa2luZCh2KV0gKz0gMQogICAgaWYgaXNpbnN0YW5jZSh2LCBkaWN0KToKICAgICAgICBmb3IgcmF3X2tleSwgY2hpbGQgaW4gdi5pdGVtcygpOgogICAgICAgICAgICBrZXkgPSBzdHIocmF3X2tleSkKICAgICAgICAgICAga2V5X2ZyZXFba2V5XSArPSAxCiAgICAgICAgICAgIGNoaWxkX3BhdGggPSBmIntwYXRofS57a2V5fSIgaWYgcGF0aCBlbHNlIGtleQogICAgICAgICAgICB3YWxrKGNoaWxkLCBjaGlsZF9wYXRoLCB0eXBlcywga2V5X2ZyZXEpCiAgICBlbGlmIGlzaW5zdGFuY2UodiwgbGlzdCk6CiAgICAgICAgY2hpbGRfcGF0aCA9IGYie3BhdGh9W10iIGlmIHBhdGggZWxzZSAiW10iCiAgICAgICAgZm9yIGNoaWxkIGluIHY6CiAgICAgICAgICAgIHdhbGsoY2hpbGQsIGNoaWxkX3BhdGgsIHR5cGVzLCBrZXlfZnJlcSkKCmRlZiBzYWZlX2tleShrLCBmcmVxKToKICAgIHJldHVybiAoCiAgICAgICAgZnJlcSA+PSAyCiAgICAgICAgYW5kIElERU5ULmZ1bGxtYXRjaChrKSBpcyBub3QgTm9uZQogICAgICAgIGFuZCBTRU1BTlRJQy5zZWFyY2goaykgaXMgbm90IE5vbmUKICAgICkKCmRlZiBzYWZlX3NoYXBlKHBhdGgsIGtleV9mcmVxKToKICAgIHBhcnRzID0gW10KICAgIGZvciBwYXJ0IGluIHBhdGguc3BsaXQoIi4iKToKICAgICAgICBzdWZmaXggPSAiW10iIGlmIHBhcnQuZW5kc3dpdGgoIltdIikgZWxzZSAiIgogICAgICAgIGtleSA9IHBhcnRbOi0yXSBpZiBzdWZmaXggZWxzZSBwYXJ0CiAgICAgICAgaWYgc2FmZV9rZXkoa2V5LCBrZXlfZnJlcS5nZXQoa2V5LCAwKSk6CiAgICAgICAgICAgIHBhcnRzLmFwcGVuZChrZXkgKyBzdWZmaXgpCiAgICAgICAgZWxzZToKICAgICAgICAgICAgcGFydHMuYXBwZW5kKCIqIiArIHN1ZmZpeCkKICAgIHJldHVybiAiLiIuam9pbihwYXJ0cykKCmRlZiBtYWluKCk6CiAgICBhcCA9IGFyZ3BhcnNlLkFyZ3VtZW50UGFyc2VyKCkKICAgIGFwLmFkZF9hcmd1bWVudCgiLS1zb3VyY2UiLCB0eXBlPVBhdGgsIHJlcXVpcmVkPVRydWUpCiAgICBhcC5hZGRfYXJndW1lbnQoIi0tb3V0IiwgdHlwZT1QYXRoLCByZXF1aXJlZD1UcnVlKQogICAgYXJncyA9IGFwLnBhcnNlX2FyZ3MoKQoKICAgIHNwZWNfZmlsZXMgPSBzb3J0ZWQoKGFyZ3Muc291cmNlIC8gImZ1bGwyMDYiIC8gImRvY3MiKS5nbG9iKCIqL3NwZWMuanNvbiIpKQogICAgaWYgbGVuKHNwZWNfZmlsZXMpICE9IEVYUEVDVEVEX1NQRUNTOgogICAgICAgIHJhaXNlIFJ1bnRpbWVFcnJvcigKICAgICAgICAgICAgZiJTZSBlc3BlcmFiYW4ge0VYUEVDVEVEX1NQRUNTfSBzcGVjIFQ1IHkgaGF5IHtsZW4oc3BlY19maWxlcyl9LiIKICAgICAgICApCgogICAgdHlwZXMgPSBkZWZhdWx0ZGljdChDb3VudGVyKQogICAga2V5X2ZyZXEgPSBDb3VudGVyKCkKCiAgICBmb3Igc3BlYyBpbiBzcGVjX2ZpbGVzOgogICAgICAgIGRhdGEgPSBqc29uLmxvYWRzKHNwZWMucmVhZF90ZXh0KGVuY29kaW5nPSJ1dGYtOC1zaWciKSkKICAgICAgICBpZiBub3QgaXNpbnN0YW5jZShkYXRhLCBkaWN0KToKICAgICAgICAgICAgcmFpc2UgUnVudGltZUVycm9yKCJVbiBzcGVjIFQ1IG5vIGVzIG9iamV0byBKU09OLiIpCiAgICAgICAgd2FsayhkYXRhLCAiIiwgdHlwZXMsIGtleV9mcmVxKQoKICAgIHNhZmVfa2V5cyA9IHNvcnRlZChrIGZvciBrLCBmcmVxIGluIGtleV9mcmVxLml0ZW1zKCkgaWYgc2FmZV9rZXkoaywgZnJlcSkpCiAgICBzaGFwZXMgPSBzb3J0ZWQoewogICAgICAgIHNhZmVfc2hhcGUocGF0aCwga2V5X2ZyZXEpCiAgICAgICAgZm9yIHBhdGggaW4gdHlwZXMKICAgICAgICBpZiBwYXRoIGFuZCBTRU1BTlRJQy5zZWFyY2gocGF0aCkKICAgIH0pCgogICAgZGVjaXNpb24gPSAoCiAgICAgICAgIlNBRkVfS0VZUz0iICsgIiwiLmpvaW4oc2FmZV9rZXlzWzoxNjBdKQogICAgICAgICsgIjtTQUZFX1NIQVBFUz0iICsgInwiLmpvaW4oc2hhcGVzWzoxNjBdKQogICAgKQoKICAgIGdhdGVzID0gewogICAgICAgICJzcGVjRmlsZXMxNiI6IFRydWUsCiAgICAgICAgInJlYWRPbmx5IjogVHJ1ZSwKICAgICAgICAibm9WYWx1ZXNQdWJsaXNoZWQiOiBUcnVlLAogICAgICAgICJub0RvY3VtZW50TmFtZXNQdWJsaXNoZWQiOiBUcnVlLAogICAgICAgICJub1ByaXZhdGVQYXRoc1B1Ymxpc2hlZCI6IFRydWUsCiAgICB9CgogICAgcmVzdWx0ID0gewogICAgICAgICJleHBlcmltZW50IjogIlMxQjgtVDZBLVNFTUFOVElDLVNDSEVNQSIsCiAgICAgICAgInBhc3MiOiBhbGwoZ2F0ZXMudmFsdWVzKCkpLAogICAgICAgICJkZWNpc2lvbiI6IGRlY2lzaW9uLAogICAgICAgICJwcm9tb3Rpb25BbGxvd2VkIjogRmFsc2UsCiAgICAgICAgIm5vdGUiOiAoCiAgICAgICAgICAgICJUNi1BIHJlYWQtb25seSBzb2JyZSBiYXNlbGluZSBUNS4gU29sbyBwdWJsaWNhIG5vbWJyZXMvY2F0ZWdvcmlhcyAiCiAgICAgICAgICAgICJkZSBjYW1wb3MgZXN0cnVjdHVyYWxlcyByZWN1cnJlbnRlczsgbm8gcHVibGljYSB2YWxvcmVzIG5pIGRvY3VtZW50b3MuIgogICAgICAgICksCiAgICAgICAgImNhbmRpZGF0ZSI6IHsKICAgICAgICAgICAgInBhZ2VzIjogMjA2LAogICAgICAgICAgICAiZWxpZ2libGVQYWdlcyI6IDE2LAogICAgICAgIH0sCiAgICAgICAgImJhc2VsaW5lIjogewogICAgICAgICAgICAicjNwUmVyZW5kZXJlZCI6IEZhbHNlLAogICAgICAgIH0sCiAgICAgICAgImdhdGVzIjogewogICAgICAgICAgICAqKmdhdGVzLAogICAgICAgICAgICAic3BlY0ZpbGVzIjogbGVuKHNwZWNfZmlsZXMpLAogICAgICAgICAgICAic2FmZUtleXMiOiBsZW4oc2FmZV9rZXlzKSwKICAgICAgICAgICAgInNhZmVTaGFwZXMiOiBsZW4oc2hhcGVzKSwKICAgICAgICB9LAogICAgfQoKICAgIGFyZ3Mub3V0LndyaXRlX3RleHQoCiAgICAgICAganNvbi5kdW1wcyhyZXN1bHQsIGVuc3VyZV9hc2NpaT1GYWxzZSwgaW5kZW50PTIpICsgIlxuIiwKICAgICAgICBlbmNvZGluZz0idXRmLTgiLAogICAgKQogICAgcHJpbnQoanNvbi5kdW1wcyhyZXN1bHQsIGVuc3VyZV9hc2NpaT1GYWxzZSkpCiAgICByZXR1cm4gMAoKaWYgX19uYW1lX18gPT0gIl9fbWFpbl9fIjoKICAgIHRyeToKICAgICAgICByYWlzZSBTeXN0ZW1FeGl0KG1haW4oKSkKICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZXhjOgogICAgICAgIHByaW50KAogICAgICAgICAgICBmIlQ2LUEgVEVDSE5JQ0FMX0ZBSUw6IHt0eXBlKGV4YykuX19uYW1lX199OiB7ZXhjfSIsCiAgICAgICAgICAgIGZpbGU9c3lzLnN0ZGVyciwKICAgICAgICApCiAgICAgICAgcmFpc2UgU3lzdGVtRXhpdCgxKQo=")
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " PDFPRIVADO PRO - S1B8-T6A SEMANTIC SCHEMA READ-ONLY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Baseline local: T5." -ForegroundColor Green
Write-Host "No modifica motor ni DOCX. No rerenderiza T4/T5/full206." -ForegroundColor Green
Write-Host ""

& $PythonExe `
    $Driver `
    --source $Source.FullName `
    --out (Join-Path $OutRoot "RESULTADO.json")

$ExitCode = $LASTEXITCODE

if ($ExitCode -eq 0) {
    Write-Host "S1B8-T6A PASS." -ForegroundColor Green
} else {
    Write-Host "S1B8-T6A fallo tecnico; T5 permanece intacta." -ForegroundColor Red
}

Write-Host "No commit/tag/promocion oficial." -ForegroundColor Green
exit $ExitCode
