#! /bin/sh


generate()
{
    if [[ $# -lt 2 ]]; then
        echo "Usage: $0 <from url> <redirect url>";
        return
    fi
    FROMURL="$1";
    TOURL="$2";

    echo "$FROMURL -> $TOURL";

    FOLDERPATH="$(pwd)/$FROMURL";
    echo $FOLDERPATH;
    mkdir -p "$FOLDERPATH";

    /usr/bin/cat << EOF > "$FOLDERPATH/index.html"
<!DOCTYPE html>
<html>
	<head>
		<title>Redirecting...</title>
		<link rel="canonical" href="$TOURL"/>
		<meta http-equiv="content-type" content="text/html; charset=utf-8" />
		<meta http-equiv="refresh" content="0; url=$TOURL" />
	</head>
	<body>
		<p><strong>Redirecting...</strong></p>
		<p><a href='$TOURL'>Click here if you are not redirected.</a></p>
		<script>
			document.location.href = "$TOURL";
		</script>
	</body>
</html>
EOF

    
}

generate $@