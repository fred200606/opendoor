<?php

namespace App\Support;

/**
 * A one-page text PDF (Helvetica, WinAnsi), as a PDF writer would make it: the demo résumés
 * (DemoCandidateSeeder) and the résumé tests.
 */
class SimplePdf
{
    /** @param  list<string>  $lines */
    public static function text(array $lines): string
    {
        $lines = array_map(fn (string $line) => mb_convert_encoding($line, 'Windows-1252', 'UTF-8'), $lines);
        $text = 'BT /F1 12 Tf 14 TL 72 720 Td '.implode(' T* ', array_map(fn ($line) => '('.addcslashes($line, '()\\').') Tj', $lines)).' ET';
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($text)." >>\nstream\n{$text}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n{$object}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= 'xref
0 '.(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }
}
