# Reads commit message from stdin, removes Cursor/Vercel co-author lines, writes to stdout
$msg = [System.Console]::In.ReadToEnd()
$lines = $msg -split "`r?`n"
$out = $lines | Where-Object {
    $_ -notmatch '^\s*Co-authored-by:\s*Cursor\s*<' -and
    $_ -notmatch '^\s*Made-with:\s*Cursor\s*$'
}
# Ensure single trailing newline
$result = ($out -join "`n").TrimEnd()
if ($result.Length -gt 0) { [System.Console]::Out.Write($result + "`n") }
