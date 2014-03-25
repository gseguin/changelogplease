var Repo = require( "git-tools" );

exports = module.exports = changelog;
exports.Changelog = Changelog;

function changelog( options, callback ) {
	var instance = new Changelog( options );

	if ( callback ) {
		instance.parse( callback );
	}

	return instance;
}

function Changelog( options ) {
	this.options = options;
	this.repo = new Repo( this.options.repo );

	// Bind all methods to the instance
	for ( var method in this ) {
		if ( typeof this[ method ] === "function" ) {
			this[ method ] = this[ method ].bind( this );
		}
	}
}

Changelog.prototype.parse = function( callback ) {
	this.getLog(function( error, log ) {
		if ( error ) {
			return callback( error );
		}

		callback( null, this.parseCommits( log ) );
	}.bind( this ));
};

Changelog.prototype.ticketUrl = function( id ) {
	return this.options.ticketUrl.replace( "{id}", id );
};

Changelog.prototype.getLog = function( callback ) {
	var commitUrl = this.options.commitUrl.replace( "{id}", "%H" );

	this.repo.exec( "log",
		"--format=" +
			"__COMMIT__%n" +
			"%s (__TICKETREF__, [%h](" + commitUrl + "))%n" +
			"%b",
		this.options.committish,
		callback );
};

Changelog.prototype.parseCommits = function( commits ) {
	commits = commits.split( "__COMMIT__\n" );
	commits.shift();

	return commits

		// Parse each individual commit
		.map( this.parseCommit )

		// Sort commits so that they're grouped by component
		.sort()
		.join( "\n" ) + "\n";
};

Changelog.prototype.parseCommit = function( commit ) {
	var ticketUrl = this.ticketUrl,
		tickets = [];

	// Sane global exec with iteration over matches
	commit.replace(
		/Fix(?:e[sd])? ((?:[a-zA-Z0-9_-]{1,39}\/[a-zA-Z0-9_-]{1,100}#)|#|gh-)(\d+)/g,
		function( match, refType, ticketId ) {
			var ticketRef = {
				url: ticketUrl( ticketId ),
				label: "#" + ticketId
			};

			// If the refType has anything before the #, assume it's a GitHub ref
			if ( /.#$/.test( refType ) ) {
				refType = refType.replace( /#$/, "" );
				ticketRef.url = "https://github.com/" + refType + "/issues/" + ticketId;
				ticketRef.label = refType + ticketRef.label;
			}

			tickets.push( ticketRef );
		}
	);

	// Add in ticket references
	// Leave __TICKETREF__ token in place so it's easy to find commits without tickets
	if ( tickets.length ) {
		commit = commit.replace( "__TICKETREF__", tickets.map(function( ticket ) {
			return "[" + ticket.label + "](" + ticket.url + ")";
		}).join( ", " ) );
	}

	// Only keep the summary for the changelog; drop the body
	return "* " + commit.split( /\r?\n/ )[ 0 ];
};
